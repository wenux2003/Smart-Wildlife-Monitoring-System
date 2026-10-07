# M1 Implementation Contract — Report and Manage Wildlife Incidents

**Project:** Wana Rakshaka / Smart Wildlife Monitoring System

**Module:** SE3070 — Case Studies in Software Engineering

**Owner:** Tharushi — M1 Incidents

**Purpose:** This file is a standalone implementation brief for Codex. Build the complete M1 use case inside the existing repository without re-scaffolding the project or breaking M2/M3/M4.

---

## 1. Read these files before editing

Codex must inspect the current repository first and read:

1. `README.md`
2. `docs/web-auth.md`
3. `docs/User_groups.md`
4. `docs/Shared_Features_Plan.md`
5. `docs/Group037_Implementation_Plan.md`
6. `docs/Group037_Assignment02_Plan.md`
7. Existing M1 and shared code under:
   - `apps/api/src/modules/incidents/`
   - `apps/api/src/modules/auth/`
   - `apps/ranger/`
   - `apps/ops/`
   - `packages/shared/`
   - `packages/offline/`
   - `apps/api/drizzle/`

The repository is the source of truth for actual filenames, existing types, scripts, routes and migration numbers.

Do **not** create a replacement project, a new backend, a new database, or a second auth system.

---

## 2. Main assessed goal

Implement the complete substantial use case:

> **Report and manage wildlife incidents**

Required end-to-end scope:

- Ranger incident form with category, description, time, location and optional photo.
- Real browser GPS capture.
- Manual location entry when GPS fails.
- Offline Ranger save using IndexedDB/Dexie.
- Reliable reconnect synchronization without duplicates.
- Community reports through:
  - mock SMS gateway
  - simple public web form
- Liaison Officer workflow:
  - inspect report
  - clarify unknown location
  - follow up for missing information
  - verify or reject
  - assign responder
  - start response
  - record outcome
  - resolve
- Camera-trap review screen.
- Incident status/history.
- Validation, failure, recovery, idempotency and authorization tests.

Do not stop at mock screens. The assessed chain must really work UI → API → DB/offline store → UI.

---

## 3. Preserve the existing architecture

Use the current stack and package boundaries:

```text
apps/api       Fastify API
apps/ranger    React/Vite Ranger PWA
apps/ops       React/Vite operations site
packages/shared
packages/offline
packages/ui
apps/api/drizzle
```

Expected technologies already present:

- TypeScript
- pnpm workspaces
- Fastify
- React/Vite
- Neon PostgreSQL/PostGIS
- existing Drizzle migrations/models
- Zod
- Dexie/IndexedDB
- Vitest
- existing auth/session system

Do not introduce unnecessary services, brokers, microservices, ORMs or frameworks.

---

## 4. Reuse existing authentication and authorization

The project already provides real sign-in plus:

- `app.authorize()`
- `assertParkAccess()`
- role context
- park context
- session enforcement

Every M1 API route must enforce access **server-side**.

Client-side route guards and hidden buttons are not enough.

For every ID-based mutation:

```text
1. authenticate
2. load target record
3. return 404 if missing
4. validate role
5. assertParkAccess(request.user, record.parkId)
6. validate ownership where applicable
7. apply domain rule
8. persist mutation + history atomically where practical
9. return typed result
```

---

## 5. Role contract

### Ranger

Can:

- create incidents in own park
- capture GPS/manual location
- attach optional photo
- save reports offline
- synchronize later
- view permitted own reports

Cannot:

- submit for another park
- perform Liaison workflow actions
- verify/reject
- assign responders
- resolve incidents operationally

### Liaison Officer

Own park only. Can:

- see community reports
- follow up for missing details
- clarify unresolved locations
- verify/reject
- assign responder
- start response
- resolve with outcome notes
- view history

### Park Manager

Own park only. Can perform park-wide M1 operational review/actions according to the existing permission contract.

### Researcher

No operational M1 mutation rights. Analytics/reporting only. Do not expose unnecessary reporter contact details.

### Super Admin

Do not automatically grant operational M1 access just because the role is global for account administration. Follow the existing auth contract.

---

## 6. Canonical M1 values

Reuse existing enums if present. Add only missing values.

```ts
type IncidentSource = "RANGER" | "COMMUNITY" | "CAMERA_TRAP";

type IncidentStatus =
  "NEW" | "VERIFIED" | "IN_PROGRESS" | "RESOLVED" | "REJECTED";

type LocationStatus = "GPS" | "MANUAL" | "LANDMARK" | "UNRESOLVED";

type SyncStatus = "PENDING" | "SYNCING" | "SYNCED" | "FAILED";

type CameraReview =
  | "PENDING"
  | "WILDLIFE"
  | "AUTHORIZED_PERSON"
  | "SUSPICIOUS_ACTIVITY"
  | "UNSURE";
```

---

## 7. Incident lifecycle — enforce centrally

Allowed transitions:

```text
NEW -> VERIFIED
NEW -> REJECTED
VERIFIED -> IN_PROGRESS
VERIFIED -> REJECTED
IN_PROGRESS -> RESOLVED
```

Forbidden examples:

```text
NEW -> IN_PROGRESS       ❌
NEW -> RESOLVED          ❌
RESOLVED -> IN_PROGRESS  ❌
REJECTED -> VERIFIED     ❌
```

Terminal records must not reopen because an old offline request is retried.

### Before `IN_PROGRESS`

Require:

- current status = `VERIFIED`
- responder assigned
- usable/resolved location when response requires location

Record:

```text
assigned_to
assigned_at
first_response_at
```

### Before `RESOLVED`

Require:

- current status = `IN_PROGRESS`
- non-empty outcome notes

Record:

```text
resolved_at
outcome_notes
```

---

## 8. Incident history/audit

Every important M1 mutation should create a history event.

Store enough information for:

```text
incident_id
actor_id
timestamp
event_type
old_status?
new_status?
notes/reason?
```

Useful events:

```text
INCIDENT_CREATED
LOCATION_UPDATED
INCIDENT_VERIFIED
INCIDENT_REJECTED
RESPONDER_ASSIGNED
RESPONSE_STARTED
INCIDENT_RESOLVED
COMMUNITY_FOLLOW_UP_SENT
CAMERA_REVIEWED
```

History must be visible on the Ops incident detail screen.

---

## 9. Migration safety — critical

Before creating a migration:

1. inspect `apps/api/drizzle/`
2. find the highest current migration number
3. confirm the next number has not been claimed by a teammate
4. create the next free number only

Never edit an already merged/applied migration.

If the current incident table already exists, extend it using a **new** migration.

Example only:

```text
0008_incident_workflow.sql
```

Do not assume `0008` is still free; re-check the repository.

Migration SQL must be safe/idempotent using the repository's established style (`IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, etc. where appropriate).

---

## 10. Shared Neon safety

Never:

- run `db:seed` on the shared Neon DB
- run an unmerged M1 migration on shared Neon
- manually alter tables through Neon UI
- commit `.env`
- print/paste `DATABASE_URL`

Test schema changes on a private Neon branch or isolated test database.

---

## 11. Incident data contract

Extend the existing incident model; do not replace it.

Support these concepts (use repository naming conventions):

```text
id / stable client UUID
park_id
source
incident type/category
species? optional
severity? if already part of agreed design
status
description

location point? nullable
location_status
location_text? nullable
location_accuracy? nullable

captured_at
received_at

reporter_id? nullable
reporter_phone? nullable
camera_image_id? nullable

revision

assigned_to? nullable
assigned_at? nullable
first_response_at? nullable
resolved_at? nullable
outcome_notes? nullable

created_at
updated_at
```

Recommended supporting persistence:

```text
incident_media
incident_events
community_messages
camera_images / camera_traps as smallest sensible schema
processed/idempotent operation data if needed by existing architecture
```

All records must be park-scoped directly or through validated foreign keys.

---

## 12. Coordinates and PostGIS

Public/shared DTOs should retain named coordinates:

```ts
{
  latitude: number;
  longitude: number;
}
```

At the PostGIS/GeoJSON boundary use:

```text
[longitude, latitude]
```

Do not reverse them.

Use SRID 4326 where consistent with the current DB setup.

---

## 13. Unknown community locations are valid

Community reports may contain only landmark/free text.

Example:

```text
"near Galge entrance"
```

If unknown:

```text
location = null
location_status = UNRESOLVED
location_text = original text
```

Do **not** invent coordinates.

If a known seeded landmark is matched:

```text
location = known approximate point
location_status = LANDMARK
location_text = original text
```

Clearly distinguish LANDMARK from GPS in UI.

---

## 14. Photo/media behavior

Photo is optional.

Submission must remain valid when:

- no photo chosen
- camera unavailable
- file picker fails
- photo storage/upload fails

Features:

- image type validation
- sensible size validation
- preview
- remove action
- stable media ID for retry
- no fake `example.com` URLs

Use the smallest working storage approach compatible with the current prototype.

---

## 15. Required API behavior

Keep existing route names if they already exist, but provide equivalent behavior for:

### Incident intake

```http
POST /api/incidents
GET  /api/incidents
GET  /api/incidents/:id
POST /api/incidents/:id/media
```

### Incident workflow

```http
PATCH /api/incidents/:id/status
PATCH /api/incidents/:id/location
POST  /api/incidents/:id/assign
POST  /api/incidents/:id/response
GET   /api/incidents/:id/history
```

### Community

```http
POST /api/community/sms
POST /api/community/reports
POST /api/community/messages/:id/follow-up
```

### Camera

```http
POST  /api/camera-images
GET   /api/camera-images
PATCH /api/camera-images/:id/review
```

Validate all request bodies with Zod/shared schemas.

Use the project's `AppError` for expected errors.

Do not use `z.any()` for completed M1 contracts unless an existing unavoidable boundary requires it.

---

## 16. Idempotency and conflict handling

Offline retry must not duplicate incidents or media.

Use stable client UUIDs and/or operation IDs.

Required behavior:

```text
save offline
→ sync starts
→ network dies before client receives response
→ client retries same operation
→ server returns the existing logical incident
→ no duplicate row
```

A stale retry must never reset a Liaison/Park Manager status change.

Use revision/expected revision for lifecycle updates if compatible with current code.

Avoid silent last-write-wins for lifecycle state.

---

## 17. Ranger incident form

Build/upgrade the Ranger incident form.

Required fields:

```text
Category
Description
Incident date/time
Location
Optional photo
```

Remove any fake/random coordinate behavior.

### GPS

Use the real browser API:

```ts
navigator.geolocation.getCurrentPosition(...)
```

Show states such as:

```text
Obtaining GPS...
GPS captured
Accuracy ±X m
GPS failed
```

### GPS failure

Provide:

```text
Retry GPS
Enter location manually
```

Manual prototype location may use latitude/longitude.

Validate:

```text
-90 <= latitude <= 90
-180 <= longitude <= 180
```

Never present stale coordinates as a fresh fix.

---

## 18. Ranger offline implementation

Implement the minimum durable M1 offline layer in `packages/offline` using the existing Dexie dependency.

`packages/offline` must remain framework-independent. Do not add React to it.

Minimum local data:

```text
incidents
incident_media (if used locally)
outbox
```

### Atomic save

Offline submit must write:

1. incident
2. outbox operation

in one IndexedDB transaction.

Only show **Saved offline** after the transaction commits.

### Outbox item concept

```text
operation_id
kind
entity_id
payload
expected_revision?
dependencies?
attempt_count
next_attempt_at
last_error
sync_status
created_at
```

### Sync states

```text
PENDING
SYNCING
SYNCED
FAILED
```

### Flush triggers

Attempt pending sync:

- Ranger app start
- app resume where practical
- browser `online` event
- manual Retry Sync
- optional small interval while app is running

Do not rely only on `navigator.onLine`; check actual API reachability such as `/health`.

### Failure behavior

- retain local work
- retry transient failures
- do not retry validation/revision conflicts forever
- keep attempt/error information
- allow manual retry
- pending work must survive refresh/app restart

---

## 19. Ranger UI feedback

Online success:

```text
Incident submitted successfully
```

Offline success:

```text
Incident saved offline
Pending synchronization
```

Failed sync:

```text
Synchronization failed
Retry
```

Never claim server synchronization before receiving a server acknowledgment.

---

## 20. Public community form

Provide a simple unauthenticated public form, preferably `/community/new` if compatible with existing routing.

Fields:

```text
Park
Phone/contact
Description
Location/landmark
```

Create source = `COMMUNITY`.

No community account is required.

---

## 21. Mock SMS gateway

Build the smallest demonstrable SMS mock.

Input concept:

```text
provider_message_id
park
phone
raw_text
```

Preserve the raw message.

A duplicate `provider_message_id` must not create another incident.

Keep parsing simple, for example:

```text
ELEPHANT crop damage @ Galge entrance
POACHING suspicious activity @ Block 3 gate
```

Do not build complex NLP.

Handle:

- valid known landmark
- valid unknown landmark
- missing information
- noisy/invalid text

Unknown but valid landmarks stay `UNRESOLVED`.

---

## 22. Community follow-up

Liaison must be able to send/store a mock follow-up when information is missing.

Persist enough data to demonstrate:

```text
follow-up text
sent time
state
actor
```

Record the action in incident/community history.

No real SMS provider is required.

---

## 23. Ops incident screens

Implement/fix:

```text
/incidents
/incidents/:id
/conflicts
/camera-traps
```

### Incident list

Show at least:

```text
source
category
status
time
location status
assigned responder if any
```

Simple filters are enough:

```text
status
source
category
```

### Incident detail

Show:

```text
category
description
source
captured time
received time
location/location status
photo if available
reporter information only to allowed roles
status
responder
response timestamps
outcome
history
```

Only show actions valid for the current status and user's role.

Remove any Researcher operational incident access.

---

## 24. Liaison conflict inbox

`/conflicts` should support:

```text
incoming COMMUNITY reports
raw message/form details
UNRESOLVED landmark indicator
send follow-up
clarify/set location
verify
reject
assign responder
start response
resolve with outcome
```

Liaison is restricted to their assigned park.

---

## 25. Location clarification

When Liaison resolves an unknown location:

```text
location_status = MANUAL
location = confirmed coordinates
```

Preserve the original `location_text` for context/audit.

Write a history event.

---

## 26. Assign responder and start response

Responder must belong to the same park and be a valid responder role according to the current project contract.

Assignment records:

```text
assigned_to
assigned_at
```

Starting response requires:

```text
status = VERIFIED
responder assigned
usable location where required
```

Then:

```text
status = IN_PROGRESS
first_response_at = now()
```

Write history.

---

## 27. Resolve incident

Require non-empty outcome notes.

Example:

```text
"Ranger team reached the area. Elephant moved back toward the forest. No injuries reported."
```

Then record:

```text
status = RESOLVED
resolved_at = now()
outcome_notes = ...
```

Write history.

---

## 28. Camera-trap review

Keep this small and demonstrable. Mock/seeded camera images are acceptable.

Camera image data should support:

```text
id
park_id
captured_at
location
image path/url
review classification
species? optional
person flag? optional/mock
reviewer_id
reviewed_at
resulting_incident_id? nullable
```

Reviewer choices:

```text
WILDLIFE
AUTHORIZED_PERSON
SUSPICIOUS_ACTIVITY
UNSURE
```

Rules:

- `UNSURE` remains reviewable.
- A person flag alone is **not** proof of poaching.
- Create an incident only after explicit reportable classification such as `SUSPICIOUS_ACTIVITY`.
- Re-review/retry of the same image must not create another incident.

---

## 29. Error handling

Use existing `AppError` conventions.

Useful M1 error codes may include:

```text
INCIDENT_NOT_FOUND
INCIDENT_INVALID_TRANSITION
INCIDENT_ASSIGNMENT_REQUIRED
INCIDENT_OUTCOME_REQUIRED
INCIDENT_LOCATION_REQUIRED
INCIDENT_REVISION_CONFLICT
INCIDENT_FORBIDDEN
INCIDENT_DUPLICATE_OPERATION
COMMUNITY_MESSAGE_DUPLICATE
CAMERA_REVIEW_INVALID
```

Prefer existing naming conventions if equivalent errors already exist.

Do not leak passwords, sessions or DB secrets.

---

## 30. Code organization

Keep business rules in the M1 service/domain layer rather than routes/React components.

Reasonable responsibilities:

```text
createIncident
updateIncidentLocation
verifyIncident
rejectIncident
assignIncidentResponder
startIncidentResponse
resolveIncident
createCommunityReport
processCommunitySms
sendCommunityFollowUp
reviewCameraImage
```

Repository code should focus on persistence.

Shared request/response schemas should live in `packages/shared` where consistent with the existing architecture.

Avoid giant components, duplicated transition rules and magic strings.

---

## 31. UI palette

Use the team's forest-green + warm-neutral palette:

```text
Primary          #166534
Sidebar          #14352B
Page background  #F6F8F5
Cards/forms      #FFFFFF
Borders          #DCE5DC
Main text        #1F2937
Secondary text   #64748B
Accent           #D97706

Resolved/success #15803D
Pending/warning  #B45309
Critical         #B91C1C
Active/info      #1D4ED8
```

Match existing Ops/Ranger styling. Do not redesign the whole system.

---

## 32. Required tests — incident/domain/API

At minimum cover:

1. Ranger creates valid own-park incident.
2. Required field validation.
3. Invalid coordinates rejected.
4. Ranger cannot submit another park.
5. Ranger can only view permitted reports.
6. Liaison cross-park access denied.
7. Park Manager cross-park access denied.
8. ID-based cross-park mutation denied.
9. No-photo incident succeeds.
10. Coordinates are returned correctly (no lat/lng reversal or disappearing location).
11. `NEW -> VERIFIED` succeeds.
12. `NEW -> REJECTED` succeeds.
13. `NEW -> RESOLVED` fails.
14. assignment required before `IN_PROGRESS`.
15. location requirement enforced when needed.
16. `VERIFIED -> IN_PROGRESS` succeeds with assignment.
17. outcome required before `RESOLVED`.
18. `IN_PROGRESS -> RESOLVED` succeeds.
19. RESOLVED cannot reopen.
20. REJECTED cannot reopen.
21. history event recorded.
22. duplicate client create is idempotent.
23. stale retry cannot overwrite newer status.
24. duplicate media retry does not duplicate media.

---

## 33. Required tests — community

Cover:

1. public community form creates report.
2. known landmark SMS.
3. unknown landmark SMS.
4. unknown landmark remains `UNRESOLVED`.
5. raw SMS preserved.
6. missing information/follow-up flow.
7. follow-up recorded.
8. duplicate provider message ID is idempotent.
9. Liaison cross-park restriction.

---

## 34. Required tests — camera

Cover:

1. PENDING can be reviewed.
2. WILDLIFE does not create suspicious incident automatically.
3. AUTHORIZED_PERSON does not create suspicious incident.
4. UNSURE remains reviewable.
5. SUSPICIOUS_ACTIVITY creates one incident.
6. repeat review does not duplicate incident.
7. incident is in the correct park.
8. cross-park camera review denied.

---

## 35. Required tests — offline

Cover the offline package/flow:

1. incident + outbox save atomically.
2. pending incident survives DB/store reopen.
3. `PENDING -> SYNCING -> SYNCED`.
4. temporary failure preserves local data.
5. retry succeeds.
6. duplicate retry does not create server duplicate.
7. media retry does not duplicate media.
8. validation/conflict does not retry forever.
9. manual retry can restart failed work.

Use `fake-indexeddb` only if needed and compatible with the repo.

Target **more than 80% meaningful coverage for M1**.

---

## 36. Manual demo flows that must work

### Demo A — Ranger online

```text
Sign in as Ranger
→ Report Incident
→ category + description
→ capture GPS
→ optional photo
→ submit
→ success
→ view created incident
```

### Demo B — Ranger offline (highest priority)

```text
Ranger already signed in
→ API/network unavailable
→ fill incident
→ save
→ "Saved offline / Pending sync"
→ refresh/reopen
→ pending work still exists
→ reconnect
→ sync/retry
→ exactly one server incident
→ local state becomes SYNCED
```

### Demo C — Liaison lifecycle

```text
Sign in as Liaison
→ open conflict/incident
→ clarify location if needed
→ VERIFIED
→ assign responder
→ IN_PROGRESS
→ record outcome
→ RESOLVED
→ open history
→ history shows full chain
```

### Demo D — Community SMS

```text
submit SMS with stable message ID
→ report appears in conflict inbox
→ unknown landmark remains unresolved
→ Liaison follows up/clarifies
→ submit same message ID again
→ no duplicate incident
```

### Demo E — Camera review

```text
open image
→ classify UNSURE
→ remains reviewable
→ review suspicious image
→ SUSPICIOUS_ACTIVITY
→ exactly one incident created
→ retry/review again
→ no duplicate incident
```

---

## 37. Build order for Codex

### Phase A — inspect

Before modifying files:

- inspect current branch/status
- inspect current M1 files
- inspect migration numbers
- inspect existing incident schema/repository/service/routes
- inspect `packages/shared`
- inspect `packages/offline`
- inspect Ranger/Ops route structure
- run baseline focused checks where practical
- identify pre-existing failures

### Phase B — backend first

Implement in this order:

1. shared M1 schemas/types
2. next safe migration/schema extension
3. repository fixes/extensions
4. central lifecycle/domain logic
5. server authorization/park checks
6. incident endpoints
7. history/idempotency
8. community endpoints
9. camera endpoints
10. focused backend tests

Do not move to UI while core backend is broken.

### Phase C — Ranger

1. real form validation
2. real GPS
3. manual fallback
4. optional photo
5. IndexedDB incident/outbox transaction
6. sync/retry
7. pending/failed feedback
8. focused Ranger/offline tests

### Phase D — Ops

1. incident list/detail
2. conflict inbox
3. location clarification
4. verify/reject
5. assignment
6. start response
7. resolve/outcome
8. history
9. camera review
10. role/route guards

### Phase E — integration and verification

Run the full M1 scenarios and repository checks.

---

## 38. Conventional Commits

Do not commit automatically unless explicitly asked.

Suggested eventual commits:

```text
feat(incidents): implement incident workflow and persistence
feat(ranger): add gps and offline incident reporting
feat(community): add community incident intake and follow-up
feat(camera): add camera-trap incident review
feat(ops): add incident response workflow
test(incidents): cover lifecycle sync and park isolation
fix(incidents): address m1 integration issues
```

Descriptions must be lowercase and imperative.

---

## 39. Verification commands

Use actual scripts present in the repository. At minimum run the equivalent of:

```bash
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
```

Also build the API/frontends using existing project scripts, and run focused M1 tests.

Do not silently ignore failures.

If an unrelated test fails:

- reproduce it
- identify it as pre-existing if confirmed
- do not modify another member's module merely to hide it

---

## 40. Definition of Done

### Ranger

- [ ] real incident form
- [ ] real GPS
- [ ] GPS failure/manual location
- [ ] coordinate validation
- [ ] optional photo
- [ ] no-photo path
- [ ] own-report visibility rules
- [ ] offline save
- [ ] restart recovery
- [ ] reconnect sync
- [ ] duplicate-safe create

### Community

- [ ] public form
- [ ] mock SMS
- [ ] raw SMS retained
- [ ] known landmark handling
- [ ] unknown landmark `UNRESOLVED`
- [ ] follow-up
- [ ] duplicate SMS protection

### Ops/Liaison

- [ ] incident list/detail
- [ ] park scoping
- [ ] location clarification
- [ ] verify
- [ ] reject
- [ ] assign responder
- [ ] start response
- [ ] resolve with outcome
- [ ] history

### Camera

- [ ] review queue
- [ ] four classifications
- [ ] UNSURE reviewable
- [ ] suspicious classification creates incident
- [ ] repeat review cannot duplicate incident

### Security

- [ ] `app.authorize()` used correctly
- [ ] `assertParkAccess()` used correctly
- [ ] cross-park reads blocked
- [ ] cross-park writes blocked
- [ ] Researcher cannot mutate M1

### Quality/testing

- [ ] main flow tests
- [ ] alternate flow tests
- [ ] exception/error tests
- [ ] idempotency tests
- [ ] offline recovery tests
- [ ] access-control tests
- [ ] M1 meaningful coverage target >80%
- [ ] lint/typecheck/tests/build pass or unrelated confirmed failures documented

### Repository safety

- [ ] no `.env` committed
- [ ] no `db:seed` on shared Neon
- [ ] no manually altered shared schema
- [ ] no reused migration number
- [ ] no edits to already-applied migrations
- [ ] no force push

---

## 41. Time-priority rule

If time becomes tight, prioritize in this order:

### Priority 1 — non-negotiable

- safe DB extension
- park/role security
- Ranger report form
- real GPS/manual fallback
- lifecycle rules
- assignment/start/resolve/outcome
- history
- offline save
- duplicate-safe reconnect sync
- core tests

### Priority 2 — still required for complete M1

- community public form
- mock SMS
- unresolved landmark flow
- Liaison conflict inbox
- minimal camera review

### Priority 3 — polish only

- richer filtering
- prettier media UI
- optional nearby-duplicate suggestions
- extra animations

Never sacrifice workflow correctness for visual polish.

---

## 42. Required final Codex report

After implementation, return these sections:

```text
A. Baseline inspected
B. Files changed
C. Migration created
D. Database changes
E. Shared contracts changed
F. API endpoints implemented
G. Ranger workflow implemented
H. Offline/sync behavior
I. Community/SMS workflow
J. Liaison/Ops workflow
K. Camera review workflow
L. Authorization and park isolation
M. Tests added
N. Focused M1 test results
O. Coverage result
P. Full test result
Q. Lint result
R. Typecheck result
S. Build result
T. Manual demo steps
U. Remaining limitations
V. Pre-existing unrelated failures
W. Suggested Conventional Commit messages
```

Do not claim completion if required flows or tests are failing.

---

## 43. Stop conditions

Stop and report instead of guessing if:

- the next migration number is ambiguous or already claimed
- the repository contains unresolved merge conflicts
- existing auth contracts changed materially from the docs
- the incident migration/schema conflicts with this brief in a destructive way
- M1 work would overwrite another member's current changes
- a broad pre-existing repo failure prevents safe verification

Do not force push, reset teammates' commits, or manually repair shared Neon data.

---

# Final Instruction to Codex

Build the full M1 implementation described above **inside the existing repository**.

The most important assessment demonstration is:

```text
Ranger saves incident offline
        ↓
IndexedDB commits incident + outbox
        ↓
network returns
        ↓
exactly one server incident is synchronized
        ↓
Liaison verifies it
        ↓
responder assigned
        ↓
response starts
        ↓
outcome recorded
        ↓
incident RESOLVED
        ↓
history shows the complete lifecycle
```

Also demonstrate:

```text
Community report/SMS
→ unresolved landmark/follow-up if needed
→ Liaison workflow
```

and:

```text
Camera image
→ human review
→ explicit suspicious classification
→ exactly one incident
```

Do not merely make the UI look complete. Implement the behavior, persistence, authorization, offline recovery, idempotency and tests.

Do **not** commit or push automatically. Stop after verified working-tree changes and the final report.
