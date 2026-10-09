# Public landing feature and access copy — 2026-10-09

Replaced the outdated In development badges with feature audiences: public reports/staff review, Ranger accounts, park operations teams, and managers/approved researchers. The platform section now explains public reporting versus protected workspaces and offers the existing community reporting link. Cards remain informational; no staff-tool access links were added. Registration buttons identify the Researcher role. FAQ copy now reflects implemented workflows, park approval requirements and Ranger offline recording.

Reviewed the existing frontend/API role checks, self-registration as RESEARCHER with no park assignment, and public `/community/new` route. No authentication, authorization, API or database changes were made.

Validation: Ops typecheck, landing-page lint and production build pass. Main JS 249.01 kB; largest chunk 383.37 kB; no bundle warning. `browser-checks.json` records anonymous production-preview checks with synthetic auth responses: four audience labels, no card navigation, correct public community-report link, clearly labelled registration, park-access guidance, no runtime exceptions, and no document horizontal overflow at 1440/780/390 px. Desktop and phone section screenshots were visually reviewed. Cropped section screenshots exclude the offscreen fixed skip-link; the app's skip link was not changed.

These are copy/layout changes; no new mirrored tests were added. Screenshots and browser checks are evidence, separate from existing application tests. Changes remain uncommitted.
