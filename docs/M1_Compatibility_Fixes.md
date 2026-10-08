# M1 compatibility and responder handoff

Legacy review notes in `incident_reviews` are included in incident detail,
history and reviews responses alongside `incident_events`. Their IDs, authors,
notes and original timestamps are preserved. An event with the same ID takes
precedence so a future backfill does not duplicate history. No shared database
backfill is required for this fix.

Ops and Ranger detail screens display `photoUrl` evidence alongside uploaded
media, omitting the fallback when the same URL is already displayed as media.

Ranger incident lists include reports they created and incidents assigned to
them in their current park. **My incidents → Assigned to me** shows assigned
community, camera and ranger reports. Only the reporter or current assigned
ranger can read ranger-accessible details; park access is always enforced.
Operators continue to assign, start responses and record outcomes. Assignment
does not create an alert dispatch. Assigned responders coordinate their work
with the park operator; reading an assignment does not grant operator actions
or permission to upload evidence to another person's report.

M1 screens use the supplied Plus Jakarta Sans typography scale, rounded green
primary actions, outlined secondary actions, green/amber status pills, 350 ms
press feedback and 800 ms card entrances staggered by 80 ms. Reduced motion
disables these animations. SOS, route animation and sheet motion remain outside
the incident screens; no new emergency behavior is introduced.

## Verification

Run `corepack pnpm lint`, `corepack pnpm typecheck`, `corepack pnpm build` and
the incident tests through the root Vitest configuration.

`apps/api/src/modules/incidents/upgrade.test.ts` accepts only an explicit
`M1_UPGRADE_TEST_DATABASE_URL` pointing to a fresh local PostGIS database. It
applies migrations 0001–0007, inserts an old report/photo/review, applies 0008
twice and checks original authors, timestamps and evidence. The entire upgrade
is rolled back. Never point this test at the team's shared database.

After migrating a separate local test database, set `M1_TEST_DATABASE_URL` to
it to run `apps/api/src/modules/incidents/repository.test.ts`. Fixtures are
rolled back. Migration 0008 remains unmerged and must not be applied to the
shared database during this verification. SMS follow-ups remain mocked.
