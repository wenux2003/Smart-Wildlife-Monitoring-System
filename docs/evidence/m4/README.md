# M4 P9 evidence — 2026-10-09

P9 closes the last planned M4 phase for the academic prototype. [Checks and coverage](./checks.md), [26-flow traceability](../../traceability.md), [plan/progress](../../M4_Analytics_and_Export_Plan.md) and [available prompt log](../../ai-prompts.md) provide the supporting record.

Evidence uses the production Ops build, the real API and a dedicated localhost PostgreSQL 16.9/PostGIS 3.5 database with deterministic synthetic fixtures. No shared Neon operation was performed. Generated run IDs/codes are local evidence identifiers, not production records. Export authors are synthetic demo identities. The park geometry is approximate.

| View                                    | Evidence                                                                |
| --------------------------------------- | ----------------------------------------------------------------------- |
| Overview                                | [Desktop](./overview-desktop.png)                                       |
| Hotspots / aggregate coverage           | [Map](./hotspot-map-desktop.png)                                        |
| Patrol gaps / priorities                | [Gaps](./patrol-gaps-desktop.png)                                       |
| Conflict sources / stretches            | [Conflicts](./conflicts-desktop.png)                                    |
| Generate without exporting              | [History: None](./history-skipped-export.png)                           |
| PDF/CSV export audit                    | [History: hashes](./history-exported.png)                               |
| Researcher aggregate view               | [Researcher](./researcher-analytics.png)                                |
| Mobile / reduced motion / visible focus | [390 CSS px](./overview-mobile-reduced-motion.png)                      |
| 200%-equivalent reflow                  | [720 CSS px on 1440 physical pixels](./overview-200-percent-reflow.png) |

[Browser/export manifest](./browser-and-export-checks.json) records no uncaught exceptions, current role/ownership privacy checks, export byte hashes and responsive results. [Saved aggregate snapshot](./report-snapshot.json) is the source for [PDF](./sample-report.pdf) and [CSV](./sample-report.csv). [Export validation](./export-validation.json) verifies SHA-256 values, 174 CSV data rows and snapshot totals (170 incidents), and the PDF's full snapshot hash. PDF extraction is [available as text](./sample-report-text.txt).

All five PDF pages were rendered at 1.25 scale with PyMuPDF (Poppler unavailable) and visually reviewed after correcting table width: [1](./pdf-page-1.png), [2](./pdf-page-2.png), [3](./pdf-page-3.png), [4](./pdf-page-4.png), [5](./pdf-page-5.png). PDF charts/maps have matching tables and synthetic/prototype notices. Full completed-file SHA-256 lives in headers/audit; the PDF footer carries the immutable snapshot SHA-256.

Primary [coverage summary](./coverage-summary.json) and separate [SQL coverage](./database-coverage-summary.json) use repository-relative paths. Local HTML reports are generated at `coverage/m4/index.html` and `coverage/m4-db/index.html`; CI uploads both directories. Hosted CI has not yet executed this revision.

Review limits: CSV was parsed as UTF-8 BOM and checked as text; native Excel visual review was not performed. The zoom evidence tests equivalent CSS reflow, not the literal browser toolbar control. Keyboard focus and behavior have browser/UI-test evidence; a complete manual keyboard traversal is supplemental. Four exact edge scenarios remain unchecked in Appendix B. Earlier P0–P7 prompts are unavailable. Optional Tier 2 enhancements are deferred; M4 completion does not certify other modules.

QA cleanup note: the final browser run completed all assertions and wrote its manifest/exports, then the CDP `Browser.close` acknowledgement timed out. PDF/CSV rendering and hash validation were run successfully afterward. This was a browser shutdown issue; no product exception was recorded.

Latest behavior: [automatic Today analytics follow-up](./automatic-analytics/README.md) supersedes the initial manual Generate interaction and records updated coverage, screenshots and checks. The files above remain the original P9 checkpoint.
