# P9 validation record

Verified 2026-10-09 on Windows using the isolated localhost PostgreSQL 16.9/PostGIS 3.5 test database. Apply migrations and seed reference accounts/analytics on that target first. Set `M4_TEST_DATABASE_URL` to the dedicated localhost `_test` database for both M4 suites; do not use shared Neon. The primary suite includes the opt-in DB tests when this variable is present.

| Command / check                           | Result                                                                                                  |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `corepack pnpm test:m4:coverage`          | 17 files / 114 tests passed; enforced 85% in all dimensions                                             |
| `corepack pnpm test:m4:db`                | 4 files / 6 isolated DB tests passed; separate repository SQL coverage                                  |
| `corepack pnpm test`                      | 260 passed; 13 opt-in DB cases skipped without DB variables (six M4 passed separately, seven unrelated) |
| `corepack pnpm lint`                      | Passed                                                                                                  |
| `corepack pnpm typecheck`                 | Passed across workspace                                                                                 |
| `corepack pnpm --filter @wr/ops build`    | Passed; main JS 236.82 kB, largest chunk 383.37 kB; no size warning                                     |
| `corepack pnpm --filter @wr/ranger build` | Passed; PWA built                                                                                       |
| `git diff --check`                        | Passed                                                                                                  |
| Actual browser + API + export checks      | Passed; see manifest and export validation                                                              |
| Rendered PDF text page bounds             | Passed for longest incident-type label and table page breaks                                            |

| Coverage                  | Statements | Branches | Functions | Lines  |
| ------------------------- | ---------- | -------- | --------- | ------ |
| Primary M4                | 96.60%     | 91.26%   | 93.36%    | 96.60% |
| SQL repository (separate) | 98.42%     | 88.46%   | 100%      | 98.42% |

`repository.ts` is the sole production exclusion from primary M4 coverage, per plan §14.1; its real spatial queries run against PostGIS and are measured separately. Test files and fixture-only `testing.ts` are also excluded. No coverage thresholds were lowered. Seed repetition/removal, concurrent distinct report codes, nearest boundary assignment, one-point/overlapping patrol tracks and grid limits are verified in this isolated database.

CI's database job now provisions `wildlife_test`, seeds analytics, enforces primary M4 coverage, runs separate SQL coverage and uploads both reports. Its hosted execution is pending after pushing. [Evidence README](./README.md) records the precise browser/manual review limits. Prior P7 migration application/idempotency checks are recorded in the plan's continuation log.

These figures describe the original P9 checkpoint. [Automatic analytics validation](./automatic-analytics/README.md) records the current 128 M4 tests and updated coverage.
