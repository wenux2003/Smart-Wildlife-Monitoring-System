# Compact dashboard and analytics/report layouts — 2026-10-09

The previous sidebar work was committed first as `e6c1d35` with a summary and full description, as requested. This folder records the subsequent UI refinement separately from the original sidebar checkpoint.

Dashboard changes: removed the redundant account-ready panel, placed staff management beside the greeting, and replaced the large placeholder tiles with compact module launchers. The desktop layout adapts to shorter viewports without clipping or hiding modules. Pending park-access guidance remains. Researchers see only their permitted analytics and report launchers.

Patrol inspection confirmed an implemented Ranger app with assignment, active patrol, waypoint and summary routes. Both frontend and API require the Ranger role. There is no existing Ops patrol-management route. The dashboard card therefore opens the existing Ranger app in a new tab and states that Ranger sign-in is required; it does not claim that a manager patrol UI exists or grant extra permissions. The URL defaults to `http://localhost:5173/` and can be set with `VITE_RANGER_APP_URL` for another deployment.

Analytics/report changes: reduced workspace chrome, page-title spacing, filter padding and card heights. Primary filters share a desktop row, while advanced/custom controls remain expandable. Repeated conflict notes and empty icon padding are removed in the shell. The map legend panel scrolls within its available height instead of leaving a large empty column beside the map. Patrol chart percentage labels are rounded for readability. Full report content remains scrollable; only the desktop dashboard is intended to fit one screen.

Validation:
- [Checks](./checks.json): 309 workspace tests passed / 14 opt-in DB cases skipped; 21 relevant navigation/analytics tests passed after the final refinement. Lint, workspace typecheck and Ops production build pass. No DB changes. Main JS 249.74 kB, largest 383.37 kB; no bundle warning.
- [Browser measurements](./browser-checks.json): synthetic API fixtures, no shared DB access. Dashboard document height equals viewport height at 1920 × 870 and 1366 × 620: no page scrolling. At 1440 px analytics, the filter panel is 119.5 px and the first KPI grid starts at 392.3 px. Verified all five analytics/report destinations, custom/advanced filters, keyboard order, automatic updates, snapshot navigation, locked conflict category, role-specific dashboard links, mobile/tablet page overflow and no uncaught exceptions.
- Screenshots were visually reviewed. Viewport sizes are browser content dimensions at ordinary zoom; mobile dashboards and full analytics reports scroll naturally.

Screenshots:
- [Desktop dashboard](./dashboard-compact-desktop.png), [short laptop dashboard](./dashboard-compact-laptop.png), [mobile dashboard](./dashboard-compact-mobile.png)
- [Analytics](./analytics-compact-desktop.png), [custom filters](./analytics-custom-filters.png), [mobile analytics](./analytics-compact-mobile.png)
- [Hotspot map](./map-compact-desktop.png), [patrol gaps](./gaps-compact-desktop.png), [conflict trends](./conflicts-compact-desktop.png), [report history](./history-compact-desktop.png)

Live app links were checked: dashboard/analytics on port 5174 and Ranger app on port 5173 return HTTP 200. No app servers were stopped for this work. These new UI refinements have not been committed automatically.

Commit checkpoint: these changes and artifacts are included in the workspace refinement commit requested on 2026-10-09. Earlier uncommitted statements describe the validation-time state.
The later [six-card dashboard evidence](../dashboard-six-cards/README.md) records removal of the Ranger launcher and the final enlarged card layout.
