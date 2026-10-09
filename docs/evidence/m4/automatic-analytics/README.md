# Automatic analytics — 2026-10-09

Follow-up to P9 requested by the user: open analytics with today's Colombo calendar day already loaded; update automatically when valid filters change. The overview, hotspot map, patrol gaps and conflict pages share the 400 ms edit delay. The optional button is now **Refresh analytics**. No migration is required for the additive `TODAY` preset, which is stored in report-filter JSON.

Each settled generation still creates an audited snapshot. Moving between compatible map/gap/overview pages reuses that snapshot; conflict analysis requests its own HWC snapshot when necessary. Opening a saved report preserves its original snapshot and dates. Changing its filters starts a new audited run. Export is paused while results are updating. Invalid or future dates stay visible with an error and do not trigger a query. Failed updates keep the previous data and offer retry; they are not retried repeatedly in the background. Automatic updates announce results without moving keyboard focus. Explicit refresh still focuses the result heading.

## Validation

| Check                                                                       | Result                                                                                      |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `corepack pnpm test:m4:coverage` with isolated local `M4_TEST_DATABASE_URL` | 18 files, 128 passed, including all six M4 DB cases                                         |
| Primary coverage                                                            | 96.93% lines/statements, 92.19% branches, 93.06% functions; enforced 85% in every dimension |
| `corepack pnpm test` without test DB variables                              | 274 passed, 13 opt-in DB cases skipped; M4 DB cases passed separately                       |
| `corepack pnpm lint`                                                        | Passed                                                                                      |
| `corepack pnpm typecheck`                                                   | Passed                                                                                      |
| `corepack pnpm --filter @wr/ops build`                                      | Passed; main JS 236.82 kB, largest chunk 383.37 kB; no bundle-size warning                  |
| Production build + actual API + isolated Docker PostGIS                     | See browser manifest and screenshots below                                                  |

The 13 cases in `apps/ops/src/features/analytics/pages/AutomaticAnalytics.test.tsx` use the actual automatic scheduler, including React StrictMode duplicate prevention, quick edit coalescing, focus, stale response protection, saved-run restoration, each spatial view, empty-day recovery, future-date rejection and failed-update retry. Existing overview tests continue to exercise explicit refresh/error controls with the scheduler isolated. `lib/filters.test.ts` covers today's default and explicit dates; domain tests verify the Colombo midnight one-day bucket.

[Coverage summary](./coverage-summary.json) records the full primary scope. SQL implementation is unchanged; all isolated DB checks passed in the combined suite. P9's separate SQL coverage remains available in the parent evidence folder. HTML coverage is regenerated at `coverage/m4/index.html`.

[Browser manifest](./browser-checks.json) records successful checks against only the dedicated localhost Docker database. No shared Neon write was performed for QA, and the project's `.env` still points to Neon. Fixtures end on 8 October, so **today (9 October) is correctly EMPTY**; widening to 30 days displays actual seeded incidents automatically.

Screenshots: [today's automatic empty state](./today-empty-automatic.png), [automatic filtered overview](./overview-filter-auto-update.png), [map snapshot reuse](./map-snapshot-reused.png), [gaps snapshot reuse](./gaps-snapshot-reused.png), [automatic conflict category](./conflicts-auto-update.png), [saved history report](./history-snapshot-preserved.png), [mobile results](./mobile-auto-results.png).

Parent P9 screenshots and coverage summaries are retained as that earlier checkpoint. This folder is the updated behavior record. The product still uses approximate synthetic geometry and prototype exports; the earlier broader manual-review limits remain documented in the parent README.
