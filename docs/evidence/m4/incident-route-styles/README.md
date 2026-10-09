# Incident route stylesheet fix — 2026-10-09

Incidents and Community inbox previously rendered without their feature stylesheet on a fresh load. Visiting Camera review loaded `IncidentFields`, whose side effects supplied the missing CSS and fonts. Refreshing discarded those styles again.

The shared UI package now exposes an explicit `@wr/ui/incident-styles` entry, used by both `IncidentLayout` and `IncidentFields`. All pages using that layout load their own styles independently of route history. Incident, Community inbox, Camera review and incident-detail browser titles are also corrected.

Validation: three existing test files / 30 passing cases (incident workflow 16, camera review 7, App routes 7). Shared UI and Ops typechecks and changed-file lint pass. Ops and Ranger production builds pass; Ops main JS 249.01 kB, largest chunk 383.37 kB, no bundle warning. The running Ops Vite server resolves the shared style import with HTTP 200.

`before-checks.json` reproduces the bug with synthetic fixtures: direct load and refresh have 16 px headings, transparent table headers, 1 px cell padding, block filters and 23 px selects. After Camera review, they have 34 px headings, green headers, 16 px padding, flex filters and 48 px selects.

`after-checks.json` verifies identical feature styles and fonts for direct navigation, Camera review round trips and hard refresh on both routes with cache disabled. Desktop width 1440 px and phone width 390 px were checked; no document horizontal overflow or uncaught exceptions. The phone table retains its existing internal horizontal scroll. Before/after desktop and after mobile screenshots are stored here; after desktop and phone screenshots were visually reviewed.

Browser checks use an isolated production preview with synthetic API fixtures. No shared database access or writes were required. The changes remain uncommitted.

Commit checkpoint: these changes and artifacts are included in the workspace refinement commit requested on 2026-10-09. Earlier uncommitted statements describe the validation-time state.
