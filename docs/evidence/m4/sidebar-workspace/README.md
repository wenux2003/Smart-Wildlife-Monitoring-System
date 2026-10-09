# Ops sidebar and central workspace — 2026-10-09

The supplied hospitality dashboard was used as a layout reference. The implemented workspace uses Wana Rakshaka branding, pale sage surfaces and forest-green active navigation. Its sidebar is shared across signed-in Ops routes; public home and authentication pages keep their existing layout.

Navigation follows existing role guards. Park Managers see operations, analytics and staff links; Researchers see their dashboard and analytics/report links; Liaison Officers see operations. Super Admin and Ranger links follow their existing destinations. Collapse preference is stored locally; icon links retain accessible names. Mobile navigation is a dialog with keyboard trapping, Escape/backdrop dismissal, background inertness and focus return.

Analytics navigation preserves report filters and saved snapshots. History-only parameters are removed when returning to analytics. The former horizontal tabs are hidden inside the shared shell. KPI cards gain icon circles, rounded corners and clearer spacing. Export controls sit below results instead of covering them. The Alerts map also fits the shared shell and stays visible on mobile, with map layers contained beneath navigation.

Validation:
- [Checks](./checks.json): 308 workspace tests passed; 14 opt-in database cases skipped in this ordinary run. Six new sidebar tests plus six existing role-route tests passed. No database code changed, so no database suite was required for this UI change.
- Lint, workspace typecheck and Ops production build pass. Main JavaScript is 249.32 kB and largest chunk 383.37 kB; no bundle warning. No dependencies added.
- [Production-browser checks](./browser-checks.json): synthetic API fixtures at 390, 780, 1440 and 1920 px; no horizontal page overflow or uncaught exceptions. Checked collapse/expand, active links, saved snapshot/filter navigation, one automatic refresh after a date change, mobile focus and dismissal, Researcher visibility, dashboard and mobile Alerts map compatibility. Browser fixtures are isolated and synthetic; no Neon data was accessed or written during this UI QA.
- Screenshots were reviewed for desktop, wide, collapsed, map, history, mobile menu, phone analytics, Researcher and dashboard layouts.

Screenshots:
- [Desktop analytics](./analytics-sidebar-desktop.png), [wide analytics](./analytics-sidebar-wide.png), [collapsed sidebar](./analytics-sidebar-collapsed.png)
- [Hotspot map](./map-sidebar-desktop.png), [report history](./history-sidebar-desktop.png)
- [Mobile menu](./sidebar-mobile-menu.png), [phone analytics](./analytics-sidebar-mobile.png)
- [Researcher navigation](./researcher-sidebar.png), [dashboard](./dashboard-sidebar-desktop.png)

The active Vite app remains available at `http://localhost:5174/analytics`. No automatic commit was made for this request.
